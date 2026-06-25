from fastapi import FastAPI

app = FastAPI()

@app.get("/")

def home():
    return {"message": "The student registration portal is running"}


@app.get("/health")
def health_check():
    return {"Health_check" : "Okay"}
    




# from fastapi import FastAPI

# app = FastAPI()

# @app.get("/")
# def home():
#     return {"message": "Student Registration Portal API is running"}

# @app.get("/health")
# def health_check():
#     return {"status": "ok"}