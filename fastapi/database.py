import os
import dotenv
from pymongo import MongoClient

dotenv.load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME= os.getenv("DB_NAME")

db = None

def connectToDatabase():
    try:
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        return db
    except Exception as e:
        print(e)

def getCollection(collectionName):
    global db
    if db is None:
        db = connectToDatabase()
    return db[collectionName]

def countData(collectionName):
    collection = getCollection(collectionName)
    return collection.count_documents({})
