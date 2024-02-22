import dotenv
import uvicorn
import openai
from fastapi import FastAPI
import json
from sentence_transformers import SentenceTransformer
from database import getCollection
from bson.json_util import dumps
import numpy as np
import os

app = FastAPI()
dotenv.load_dotenv()

model = SentenceTransformer('bkai-foundation-models/vietnamese-bi-encoder')

def get_response(prompt):
    openai.api_key = os.getenv('OPENAI_API_KEY')
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=prompt,
        temperature = 0,
    )
    intention = response['choices'][0]['message']['content']
    return intention

def emb_corpus(field):
    _emb = model.encode(field)
    _emb /= np.linalg.norm(_emb, axis=1)[:, np.newaxis]
    return _emb

def semantic_find(query, field, corpus, entity, threshold=0.2):
    field_emb = emb_corpus(field=field)
    question_emb = model.encode([query])
    question_emb /= np.linalg.norm(question_emb, axis=1)[:, np.newaxis]
    semantic_scores = question_emb @ field_emb.T
    semantic_scores = semantic_scores[0]
    for i in range(len(corpus)):
        if semantic_scores[i] >= threshold:
            corpus[i]["semantic_score"] += semantic_scores[i] * entity['importance']
    return semantic_scores, corpus

def retrieval(computers, entities, rank=5):
    for i in range(len(computers)):
        computers[i]["semantic_score"] = 0
    for entity in entities:
        if entity['type'] == 'id product':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [str(item['id']) for item in computers], computers, entity)
        if entity['type'] == 'product name':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['productName'] for item in computers], computers, entity)
        if entity['type'] == 'cost':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [str(item['price']) for item in computers], computers, entity)
        if entity['type'] == 'chip':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['CPU'] for item in computers] , computers, entity)
        if entity['type'] == 'RAM':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['RAM'] for item in computers] , computers, entity)
        if entity['type'] == 'hard disk':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['disk'] for item in computers], computers, entity)
        if entity['type'] == 'graphic capacity':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['screen'] for item in computers], computers, entity)
        if entity['type'] == 'brand':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['productName'] for item in computers], computers, entity)
        if entity['type'] == 'product type':
            print("Process: ", entity['type'])
            _, computers = semantic_find(entity['entity'], [item['productName'] for item in computers], computers, entity)
    return sorted(computers, key=lambda x: x["semantic_score"], reverse=True)[:rank]

def retrievalE2E(query, rank):
    sys_prompt=[{"role": "system", "content": """
        Your task is to extract the key entities mentioned in the users input in the computer domain.
Entities may include - id product, product name, product type, CPU, RAM, hard disk, screen computer, battery capacity, graphic card, use purpose, brand, cost, etc.
Format your output as a list of JSON with the following structure.
[{
 "entity": The Entity string,
"importance": How important is the entity given the context on a scale of 1 to 5, 5 being the highest.,
"type": Type of entity,
}, { }]
"""}]
    sys_prompt.append({"role": "user", "content": query})
    get_entities = get_response(sys_prompt)
    print(get_entities)
    entities = json.loads(get_entities)
    top_computers = retrieval(computers, entities, rank=rank)
    return top_computers

def getComputer(query, rank):
    global computers
    #with open('computers.json', encoding='utf8') as f:
    #    computers = json.load(f)
    computers = json.loads(dumps(list(getCollection('computers').find())))
    print(type(computers), len(computers))
    return retrievalE2E(query, rank)

@app.get("/search")
def search(q: str, rank:int):
    result = getComputer(q, rank)
    return {"result": result}

@app.get("/")
def hello():
    return {"message": "Hello, world! This is TURBO"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
