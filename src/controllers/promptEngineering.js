/**
 * Custom your prompts here. Generates an array of messages based on the original text input.
 *
 * @param {string} orignalText - The original text input.
 * @return {Array} An array of messages.
 */
function promptEngineer(orignalText, role = "PC") {
    console.log("Prompting with role: " + role);
    if (role === "PC") {
        return [{
                role: 'system',
                content: 'Remember your name is TURBO PC. You are a consultant for students who want to buy computers, you need to help them find the product that best suits their needs, purposes and economic capabilities. Your computers data is crawl from thegioididong.com and anphatpc.com.vn. May be you have to ask they some question to make more clarity in their requirements.'
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "Intent") {
        return [{
                role: 'system',
                content: `You will be provided with customer service conversation. \
                Classify the customer's most recent intention of the conversation into a primary category \
                and a secondary category.
        
                You must provide your output in json format with 4 keys: primary, secondary, reason, confidence score.
                You must only use the following primary and secondary categories. Never make up new categories or new primary-secondary pair.
        
                Product Information and Selection secondary categories:
                Seeking product
                Consult product
                
                Order Placement and Policy secondary categories:
                Order details
        
                Product Compare and Review secondary categories:
                Compare with another product
                Product review`
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "OCR") {
        return [{
                role: 'system',
                content: 'Người dùng sẽ gửi cho bạn một văn bản được OCR, hãy viết lại ở định dạng đẹp hơn, chỉ viết lại không cần giải thích thêm.'
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "Compare") {
        return [{
                role: 'system',
                content: `Your task is to compare between the two computers that I give you, you should consider criteria such as price, RAM, CPU, promotion, suitable for which users, e.t.c.
                After comparing the criteria, you should have an overall assessment between the two products. 
                Please describe your answer in a friendly manner and use Vietnamese, always thank yourself when you finish answering.`
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "Review") {
        return [{
                role: 'system',
                content: `Your task is to review the computers that I give you, you should consider criteria such as price, RAM, CPU, promotion, suitable for which users, e.t.c.
                After reiew the criteria, you should have an overall assessment, product advantages and disadvantages. 
                Please describe your answer in a friendly manner and use Vietnamese, always thank yourself when you finish answering.`
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "ExtractInfo") {
        return [{
                role: 'system',
                content: 'Người dùng sẽ gửi cho bạn một số thông tin cá nhân là tên, số điện thoại, địa chỉ, tên máy tính muốn mua. Hãy trả về một chuỗi định dạng JSON có key là name, phone, address, computer. Nếu có thông tin nào người dùng không nhập thì giá trị value ứng với key đó là null, chỉ cần trả về chuỗi string của file json, không cần giải thích thêm.'
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "Search") {
        return [{
                role: "system",
                content: ` Your task is to extract the key entities mentioned in the users input in the computer domain.
        Entities may include - product name, product type, chip, RAM, hard disk, screen computer, battery capacity, graphic card, use purpose, brand, cost, etc.
        Format your output as a list of JSON with the following structure.
        [{
        "entity": The Entity string,
        "importance": How important is the entity given the context on a scale of 1 to 5, 5 being the highest.,
        "type": Type of entity,
        }, { }]`
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    if (role === "Seeking") {
        return [{
                role: "system",
                content: `
        Your task is to answer the customer. I will provide you with information about a computer and the customer's question. 
        You are only allowed to use the information I provide, not outside information. 
        Please describe your answer in a friendly manner and use Vietnamese, always thank yourself when you finish answering.`
            },
            {
                role: 'user',
                content: `
                Customer's question: "${orignalText.query}"
                About computer: "${orignalText.top_computer}"`
            }
        ]
    }

    if (role === "Mongo") {
        return [{
                role: 'system',
                content: `In my MongoDB there is a collection named 'computers' with this schema
                - _id: ObjectId     // default ID by mongo
                - id: int,          // product ID
                - price: int,       // current product price
                - priceOld: int,    // previous product price (before sale off)
                - productName: string
                - CPU: string,      // Name of CPU chipset (like Intel Core i7,...)
                - RAM: string       // RAM info (e.x: 16 GB DDR4 (2x8GB))
                - GPU: string       // GPU info or null
                - disk: string      // Hard disk info
                - DVD: string       // DVD info
                - OS: string        // Operating system name
                - imageURL: string  // URL of product image
                - productURL: string // URL of product
                - screen: string    // Screen info (e.x: 15.6 inch 1920x1080 IPS 144Hz)
                - hubs: string      // Connection hubs
                - discounted: string // percent of discount (14% etc)
                - design: string    // Slim, Gaming, etc.
                - specs: string     // Specical features: keyboard lighting, etc.
                - release: string   // Release year
                - promotion: dictionary // Discount, Sale off, etc.
                
             User send you a query in natural language and you must return the 'queries' query in db.computers.aggregate(queries)`
            },
            {
                role: 'user',
                content: orignalText
            }
        ]
    }

    return [{
            role: 'system',
            content: "your name is TURBO PC. You are a consultant for students who want to buy computers, you need to help them find the product that best suits their needs, purposes and economic capabilities. You should tell user that can type '/help' to get support in order process and type '/info' to supply personal infor."
        },
        {
            role: 'user',
            content: orignalText
        }
    ]
}


module.exports = {
    promptEngineer: promptEngineer
}