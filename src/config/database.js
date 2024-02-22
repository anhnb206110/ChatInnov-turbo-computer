import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
dotenv.config()

let db;

async function connectToDatabase() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    console.log("Connecting to database...");
    try {
        await client.connect();
        db = client.db(process.env.DB_NAME);
    } catch (e) {
        console.error(e);
        throw new Error('Unable to connect to database');
    }
}

async function getCollection(collectionName) {
    if (!db) {
        try {
            await connectToDatabase();
        } catch (e) {
            console.error(e);
            throw new Error('No database connection');
        }
    }

    return db.collection(collectionName);
}

async function insertData(collectionName, data) {
    const collection = await getCollection(collectionName);
    return collection.insertOne(data);
}

async function getData(collectionName) {
    const collection = await getCollection(collectionName);
    return collection.find().toArray();
}

async function getOneData(collectionName, query) {
    const collection = await getCollection(collectionName);
    return collection.findOne(query);
}

async function countData(collectionName, query) {
    const collection = await getCollection(collectionName);
    return collection.countDocuments(query);
}

module.exports = {
    connectToDatabase: connectToDatabase,
    getCollection: getCollection,
    insertData: insertData,
    getData: getData,
    getOneData: getOneData,
    countData: countData
}