import express from "express";
import viewEngine from "./config/viewEngine";
import { connectToDatabase, getCollection } from "./config/database";
import initWebRoutes from "./routes/web";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
let app = express();

async function main() {
    try {
        await connectToDatabase();
        console.log('\x1b[32m%s\x1b[0m', 'Connected to the database successfully!');
    } catch (e) {
        console.error('An error occurred when connecting to the database:', e.message);
    }
}

// config view engine
viewEngine(app);

// parse request to json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// init web routes
initWebRoutes(app);

let port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`ChatInnov is running on the port ${port}`);
    main();
})