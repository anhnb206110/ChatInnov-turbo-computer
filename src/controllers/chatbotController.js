import dotenv from "dotenv";
import request from "request";
import OpenAI from "openai";
import { getCollection, countData } from "../config/database";
import { promptEngineer } from "../controllers/promptEngineering";
import { createWorker } from "tesseract.js";
const axios = require('axios');

dotenv.config()

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const OPENAI_MODEL = process.env.CHAT_MODEL;
const PAGE_ID = process.env.PAGE_ID;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

let getHomePage = (req, res) => {
    return res.send("TURBO chatbot is running");
}

let getWebhook = (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
}

let postWebhook = async(req, res) => {
    let body = req.body;

    if (body.object === "page") {
        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(async function(entry) {
            let webhook_event = entry.messaging[0];

            let sender_psid = webhook_event.sender.id;
            if (sender_psid === process.env.PAGE_ID) {
                return;
            }
            console.log('Sender PSID: ' + sender_psid);
            getCollection('chat_users').then(collection => {
                collection.updateOne({
                    sender_psid: sender_psid,
                }, {
                    $set: {
                        sender_psid: sender_psid,
                        name: webhook_event.sender.name
                    }
                }, {
                    upsert: true
                })
            })
            if (webhook_event.message) {
                await handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });

        // Respond to webhook event
        res.status(200).send("EVENT_RECEIVED");
    } else {
        res.sendStatus(404);
    }
}

async function getHistoryChat(sender_psid, number = 5) {
    return await getCollection('messages').then(collection => {
        return collection.find({
            $or: [
                { sender_psid: sender_psid },
                { recipient_psid: sender_psid }
            ]
        }).sort({ time_sent: -1 }).limit(number).toArray();
    })
}

async function getChatGPTResponse(sender_psid, message) {
    try {
        await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
        await callSendAPI(sender_psid, { sender_action: 'typing_on' });
        // Get lastest 10 messages between page and the user (sender_psid == user_psid | receiver_psid == user_psid, sorted by time_sent) 
        const messages = await getHistoryChat(sender_psid);
        // Convert message to role-content
        let prompt = [];
        let promptEngineered = promptEngineer(message);
        prompt.push(promptEngineered[0]);
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender_psid === sender_psid) {
                prompt.push({
                    role: 'user',
                    content: messages[i].message || ''
                });
            } else {
                prompt.push({
                    role: 'assistant',
                    content: messages[i].message || ''
                });
            }
        }
        prompt.push(promptEngineered[1]);
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: prompt
        });
        const gptResponse = response.choices[0].message.content.trim();
        console.log("GPT: " + gptResponse);
        return gptResponse;
    } catch (error) {
        console.error(error);
        return "** " + error.message + " **";
    }
}

async function createImageCarousel(images) {
    if (images.length === 0) {
        return {
            "text": "Tôi không hiểu tin nhắn bạn gửi!"
        };
    }
    // OCR if only 1 image
    if (images.length === 1) {
        const ocrText = await extractOCR(images[0]);
        console.log("OCR: " + ocrText);
        const rewrite = promptEngineer(ocrText, "OCR");
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: rewrite
        });
        const title = response.choices[0].message.content.trim();
        return {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": title,
                        "subtitle": "Nhận dạng OCR",
                        "image_url": images[0],
                    }]
                }
            }
        };
    }
    // If many images then create carousel choose best image
    let elements = images.map((imageUrl, index) => {
        return {
            "title": "Đâu là bức ảnh đẹp nhất?",
            "subtitle": "Bức ảnh số " + (index + 1),
            "image_url": imageUrl,
            "buttons": [{
                    "type": "postback",
                    "title": "Yes!",
                    "payload": "yes" + (index + 1),
                },
                {
                    "type": "postback",
                    "title": "No!",
                    "payload": "no" + (index + 1),
                }
            ]
        };
    });
    // Return the carousel
    let response = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": elements
            }
        }
    };

    return response;
}

async function getGPTJsonResponse(sender_psid, rewrite, messages = []) {
    let prompt = [];
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].sender_psid === sender_psid) {
            prompt.push({
                role: 'user',
                content: messages[i].message || ''
            });
        } else {
            prompt.push({
                role: 'assistant',
                content: messages[i].message || ''
            });
        }
    }
    prompt.push(rewrite[0]);
    prompt.push(rewrite[1]);
    const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: prompt
    });
    const data = response.choices[0].message.content.trim();
    return data
}

// For help customer
async function handleInfoCommand(sender_psid, message) {
    const keys_vi = { 'name': 'Tên', 'phone': 'Số điện thoại', 'address': 'Địa chỉ', 'computer': 'Máy tính muốn tư vấn' };
    const info = message.substring('/info'.length).trim();
    if (message.trim() === '/info') {
        return {
            'text': await getCollection('reminder').then(async collection => {
                const result = await collection.find({ sender_psid: sender_psid }).toArray();
                let retText = `Bạn đã đặt ${result.length} lịch hẹn.\n`;
                result.forEach((item, index) => {
                    retText += ` - ${index + 1}. Tư vấn về ${item.computer}. \nTrạng thái: *${item.status}*\n`;
                });
                retText += '\nNếu có thắc mắc gì hãy liên hệ với chúng tôi qua SĐT được ghi trên page.'
                return retText;
            })
        }
    }

    const rewrite = promptEngineer(info, "ExtractInfo");
    await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
    await callSendAPI(sender_psid, { sender_action: 'typing_on' });
    const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: rewrite
    });
    let user_info = response.choices[0].message.content.trim();
    const data = JSON.parse(user_info);
    const keys = [];
    let retText = `Thông tin đã nhận từ bạn vào lúc ${new Date().toLocaleString('vi-VN')}: \n`;
    for (const [key, value] of Object.entries(data)) {
        if (value === null) {
            keys.push(keys_vi[key]);
        } else {
            retText += `${keys_vi[key]}: ${value}` + '\n'
        }
    }
    const keysString = keys.join(", ");

    getCollection('chat_users').then(collection => {
        collection.updateOne({
            sender_psid: sender_psid
        }, {
            $set: {
                name: data.name,
                phone: data.phone,
                address: data.address
            }
        })
    });
    console.log("Update user:", sender_psid, data);

    getCollection('reminder').then(collection => {
        collection.insertOne({
            sender_psid: sender_psid,
            computer: data.computer,
            time_set: new Date(),
            status: 'Not meet'
        })
    });
    const addtional = keys.length ? `\nBạn có thể cần thêm thông tin về ${keysString}` : "";
    return {
        "text": retText + '\nChúng tôi sẽ sớm liên hệ lại bạn trong thời gian sớm nhất!' + addtional
    };
}

// For recommend computer
async function handleQueryCommand(sender_psid, message) {
    await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
    await callSendAPI(sender_psid, { sender_action: 'typing_on' });
    let response = await axios.get(process.env.ENCODER_API, {
        params: {
            q: message.trim(),
            rank: 3,
        }
    }).catch(error => {
        console.error(error);
    });

    let top_computers = JSON.stringify(response.data.result);
    console.log(top_computers);
    let user_query = {
        query: message.trim(),
        top_computer: top_computers
    };
    const rewrite = promptEngineer(user_query, "Seeking");

    const openaiResponse = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: rewrite
    });
    let user_info = openaiResponse.choices[0].message.content.trim();

    return {
        "text": user_info
    };
}

async function handleConsultCommand(sender_psid, message) {
    await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
    await callSendAPI(sender_psid, { sender_action: 'typing_on' });
    const rewrite = promptEngineer(message);
    const messages = await getHistoryChat(sender_psid);
    const res = await getGPTJsonResponse(sender_psid, rewrite, messages);
    return {
        'text': res
    }
}

async function handleCompareCommand(sender_psid, message) {
    await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
    await callSendAPI(sender_psid, { sender_action: 'typing_on' });
    const rewrite = promptEngineer(message, "Compare");
    const messages = await getHistoryChat(sender_psid);
    const res = await getGPTJsonResponse(sender_psid, rewrite, messages);
    return {
        'text': res
    }
}

async function handleReviewCommand(sender_psid, message) {
    await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
    await callSendAPI(sender_psid, { sender_action: 'typing_on' });
    const rewrite = promptEngineer(message, "Review");
    const messages = await getHistoryChat(sender_psid);
    const res = await getGPTJsonResponse(sender_psid, rewrite, messages);
    return {
        'text': res
    }
}

async function handleOrderCommand(sender_psid, message) {
    await callSendAPI(sender_psid, { sender_action: 'mark_seen' });
    await callSendAPI(sender_psid, { sender_action: 'typing_on' });
    const rewrite = promptEngineer(message, "Order");
    const messages = await getHistoryChat(sender_psid);
    const res = await getGPTJsonResponse(sender_psid, rewrite, messages);
    return {
        'text': res
    }
}

function handleHelpCommand() {
    return {
        'text': 'Đây là chatbot hỗ trợ tư vấn mua máy tính đang trong quá trình phát triển.\n\nHiện tại, bạn có thể sử dụng một trong các chức năng sau: \n' +
            '  - Gửi 1 hình ảnh để thực hiện OCR (Có thể là ảnh chụp màn hình về cấu hình sản phẩm). \n' +
            '  - /info <thông tin cá nhân>: Bạn có thể để lại thông tin cá nhân để được liên hệ hỗ trợ tư vấn về loại máy tính cụ thể. \n' +
            '  - /help: Hiển thị trợ giúp này.'
    }
}

async function addMessage(sender_psid, recipient_psid, response) {
    getCollection('messages').then(collection => {
        collection.insertOne({
            sender_psid: sender_psid,
            recipient_psid: recipient_psid,
            time_sent: new Date(),
            message: response.text
        })
    })
}

async function handleMessage(sender_psid, received_message) {
    let response;
    // Handle text
    if (received_message.text) {
        addMessage(sender_psid, PAGE_ID, received_message);
        if (['hello', 'hi', 'xin chào', 'chào', 'chào bạn'].includes(received_message.text.toLowerCase())) {
            response = {
                "text": "Xin chào! Tôi là TURBO PC chatbot chuyên hỗ trợ về tư vấn lựa chọn máy tính cho sinh viên dựa trên GPT 3.5, bạn có thể đặt bất kỳ câu hỏi nào cho tôi! :*. (Gửi /help để xem hướng dẫn)"
            }
        } else if (received_message.text.startsWith('/help')) {
            response = handleHelpCommand();
        } else if (received_message.text.startsWith('/info')) {
            response = await handleInfoCommand(sender_psid, received_message.text);
        } else {
            let intent = await getGPTJsonResponse(sender_psid, promptEngineer(received_message.text, "Intent"));
            console.log(intent);
            intent = JSON.parse(intent.replace("```json", "").replace("```", ""));
            if (intent.secondary === "Seeking product") {
                response = await handleQueryCommand(sender_psid, received_message.text);
            } else if (intent.secondary === "Consult product") {
                response = await handleConsultCommand(sender_psid, received_message.text);
            } else if (intent.secondary === "Order details") {
                response = await handleOrderCommand(sender_psid, received_message.text);
            } else if (intent.secondary === "Compare with another product") {
                response = await handleCompareCommand(sender_psid, received_message.text);
            } else if (intent.secondary === "Product review") {
                response = await handleReviewCommand(sender_psid, received_message.text);
            } else {
                const answer = await getChatGPTResponse(sender_psid, received_message.text);
                response = {
                    "text": answer
                }
            }
        }
    }
    // Handle images
    else if (received_message.attachments) {
        // Get all images in attachments
        let attachment_urls = received_message.attachments
            .filter((attachment) => attachment.type === 'image')
            .map((attachment) => attachment.payload.url);
        await callSendAPI(sender_psid, { sender_action: 'typing_on' });

        response = await createImageCarousel(attachment_urls);
        // If only 1 image, OCR it.
        if (attachment_urls.length === 1) {
            await callSendAPI(sender_psid, { 'text': response.attachment.payload.elements[0].title })
        }
    }
    // Send response
    try {
        await callSendAPI(sender_psid, response);
        await callSendAPI(sender_psid, { sender_action: 'typing_off' });
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

async function handlePostback(sender_psid, received_postback) {
    let response;
    let payload = received_postback.payload;
    if (payload.startsWith("yes")) {
        response = {
            "text": "Bạn đã chọn bước ảnh đẹp nhất!" + "\n" + "Bức ảnh số " + payload.slice(3)
        }
    } else if (payload.startsWith("no")) {
        response = {
            "text": "Oops, vậy thì chọn ảnh khác đi."
        }
    } else {
        response = {
            "text": "Cảm ơn vì đã phản hồi!"
        }
    }

    try {
        await callSendAPI(sender_psid, response);
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

function splitAndSendMessages(sender_psid, response) {
    // Split response.text into messages of 2000 characters or less
    let texts = response.text.split('\n');
    // Make sure text in texts is length < 2000 else split text into subtexts
    let subtexts = [];
    texts.forEach((text) => {
        let start = 0;
        while (start < text.length) {
            subtexts.push(text.slice(start, start + 2000));
            start += 2000;
        }
    });
    // Combine subtext
    let messages = [];
    let message = '';
    subtexts.forEach((text) => {
            if (message.length + text.length > 2000) {
                messages.push(message);
                message = '';
            }
            message += text + '\n';
        })
        // Send each combine subtext
    messages.push(message);
    messages.forEach((message, index) => {
        console.log("Send part " + (index + 1) + "/" + messages.length);
        callSendAPI(sender_psid, {
            "text": message
        });
    });
}

async function extractOCR(url) {
    const worker = await createWorker('vie');
    const ret = await worker.recognize(url);
    await worker.terminate();
    return ret.data.text;
}

function callSendAPI(sender_psid, response) {
    let request_body = {
        "recipient": {
            "id": sender_psid
        }
    };

    console.log("Call send API with info: " + JSON.stringify(response));

    // Check if response is a sender action like 'typing_on', 'typing_off' or 'mark_seen'
    if (response && response.sender_action) {
        console.log("Call send API with sender_action: " + response.sender_action);
        request_body.sender_action = response.sender_action;
    } else if (response && response.text && response.text.length > 2000) {
        console.log("Call send API with text");
        splitAndSendMessages(sender_psid, response);
        return;
    } else {
        console.log("Call send API with attachments or short text");
        if (response && response.text) {
            addMessage(PAGE_ID, sender_psid, response);
        }
        request_body.message = response;
    }

    return new Promise((resolve, reject) => {
        request({
            "uri": "https://graph.facebook.com/v2.6/me/messages",
            "qs": { "access_token": PAGE_ACCESS_TOKEN },
            "method": "POST",
            "json": request_body
        }, (err, res, body) => {
            if (!err) {
                console.log('Call send API success!');
                resolve(body);
            } else {
                console.error("Unable to call send API:" + err);
                reject(err);
            }
        })
    });
}


module.exports = {
    getHomePage: getHomePage,
    getWebhook: getWebhook,
    postWebhook: postWebhook
}