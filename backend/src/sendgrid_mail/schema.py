from pydantic import BaseModel,Field




class EmailModel(BaseModel):
    addresses : str

