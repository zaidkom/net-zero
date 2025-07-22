from fastapi import FastAPI, UploadFile, File, Request, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from io import BytesIO
import json
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
import os
from fastapi.responses import FileResponse
import traceback
import pandasql

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATABASE_URL = "sqlite:///./users.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    data_prep = Column(Text, default="")
    analysis = Column(Text, default="")
    visualisation = Column(Text, default="")

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    message: str

class SignupRequest(BaseModel):
    username: str
    password: str

class SignupResponse(BaseModel):
    success: bool
    message: str

class WorkflowBase(BaseModel):
    name: str
    data_prep: str = ""
    analysis: str = ""
    visualisation: str = ""

class WorkflowCreate(WorkflowBase):
    username: str

class WorkflowUpdate(BaseModel):
    name: str = None
    data_prep: str = None
    analysis: str = None
    visualisation: str = None

class WorkflowOut(WorkflowBase):
    id: int

@app.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not pwd_context.verify(request.password, user.hashed_password):
        return LoginResponse(success=False, message="Invalid username or password")
    return LoginResponse(success=True, message="Login successful")

@app.post("/signup", response_model=SignupResponse)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == request.username).first():
        return SignupResponse(success=False, message="Username already exists")
    hashed_password = pwd_context.hash(request.password)
    user = User(username=request.username, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    return SignupResponse(success=True, message="Signup successful")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    sheet_names = []
    df = None
    if file.filename.endswith('.csv'):
        df = pd.read_csv(BytesIO(content))
        sheet_names = ['sheet1']
        sheets = {'sheet1': df}
    elif file.filename.endswith('.xlsx'):
        xls = pd.ExcelFile(BytesIO(content))
        sheet_names = xls.sheet_names
        sheets = {name: xls.parse(name) for name in sheet_names}
        df = sheets[sheet_names[0]]
    else:
        return {"error": "Unsupported file type"}

    preview = df.head(100)
    return {
        "sheet_names": sheet_names,
        "selected_sheet": sheet_names[0],
        "columns": [{"title": col, "dataIndex": col, "key": col} for col in preview.columns],
        "data": preview.to_dict(orient="records")
    }

@app.post("/preview_sheet")
async def preview_sheet(request: Request):
    body = await request.json()
    file_content = BytesIO(bytes(body["file_content"]))
    sheet_name = body["sheet_name"]
    if body["file_type"] == "csv":
        df = pd.read_csv(file_content)
    else:
        xls = pd.ExcelFile(file_content)
        df = xls.parse(sheet_name)
    preview = df.head(100)
    return {
        "columns": [{"title": col, "dataIndex": col, "key": col} for col in preview.columns],
        "data": preview.to_dict(orient="records")
    }

@app.post("/transform")
async def transform(request: Request):
    body = await request.json()
    data = body.get("data")
    code = body.get("code")
    mode = body.get("mode")  # "sql" or "python"

    df = pd.DataFrame(data)
    try:
        if mode == "sql":
            import pandasql
            query = code
            result = pandasql.sqldf(query, {"df": df})
        elif mode == "python":
            # WARNING: This is a simple and insecure example!
            # In production, use a sandboxed environment.
            local_vars = {"df": df}
            exec(code, {}, local_vars)
            result = local_vars["df"]
        else:
            return {"error": "Invalid mode"}
    except Exception as e:
        return {"error": str(e)}

    preview = result.head(100)
    return {
        "columns": [{"title": col, "dataIndex": col, "key": col} for col in preview.columns],
        "data": preview.to_dict(orient="records")
    }

@app.post("/api/execute-query")
async def execute_query(request: Request):
    body = await request.json()
    query = body.get("query")
    language = body.get("language")  # "sql" or "python"
    tables = body.get("tables")  # dict of table_name: data
    data = body.get("data")  # backward compatibility

    # If only 'data' is sent, treat as single table 'df'
    if tables is None and data is not None:
        tables = {"df": data}
    if not tables:
        return {"error": "No tables provided"}

    # Create DataFrames for all tables
    dfs = {name: pd.DataFrame(tbl) for name, tbl in tables.items()}
    try:
        if language == "sql":
            import pandasql
            # Register all tables in the query context
            result = pandasql.sqldf(query, dfs)
        elif language == "python":
            # Provide all DataFrames in the exec namespace
            local_vars = {**dfs}
            exec(query, {}, local_vars)
            # By convention, return the first table (or 'df' if present)
            result = local_vars.get("df") or list(local_vars.values())[0]
        else:
            return {"error": "Invalid language"}
    except Exception as e:
        return {"error": str(e)}

    preview = result.head(100)
    return {
        "columns": [{"title": col, "dataIndex": col, "key": col} for col in preview.columns],
        "data": preview.to_dict(orient="records")
    }

@app.post("/upload_excel")
async def upload_excel(file: UploadFile = File(...)):
    filename = file.filename
    save_path = os.path.join(UPLOAD_DIR, filename)
    with open(save_path, "wb") as f:
        f.write(await file.read())
    return {"path": f"uploads/{filename}"}

@app.get("/download_excel/{filename}")
def download_excel(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename=filename)

@app.get("/workflows", response_model=list[WorkflowOut])
def list_workflows(username: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    workflows = db.query(Workflow).filter(Workflow.user_id == user.id).all()
    return [WorkflowOut(id=w.id, name=w.name, data_prep=w.data_prep, analysis=w.analysis, visualisation=w.visualisation) for w in workflows]

@app.post("/workflows", response_model=WorkflowOut)
def create_workflow(workflow: WorkflowCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == workflow.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    w = Workflow(user_id=user.id, name=workflow.name, data_prep=workflow.data_prep, analysis=workflow.analysis, visualisation=workflow.visualisation)
    db.add(w)
    db.commit()
    db.refresh(w)
    return WorkflowOut(id=w.id, name=w.name, data_prep=w.data_prep, analysis=w.analysis, visualisation=w.visualisation)

@app.get("/workflows/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    w = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowOut(id=w.id, name=w.name, data_prep=w.data_prep, analysis=w.analysis, visualisation=w.visualisation)

@app.put("/workflows/{workflow_id}", response_model=WorkflowOut)
def update_workflow(workflow_id: int, update: WorkflowUpdate, db: Session = Depends(get_db)):
    w = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if update.name is not None:
        w.name = update.name
    if update.data_prep is not None:
        w.data_prep = update.data_prep
    if update.analysis is not None:
        w.analysis = update.analysis
    if update.visualisation is not None:
        w.visualisation = update.visualisation
    db.commit()
    db.refresh(w)
    return WorkflowOut(id=w.id, name=w.name, data_prep=w.data_prep, analysis=w.analysis, visualisation=w.visualisation)

@app.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    w = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(w)
    db.commit()
    return {"success": True}

@app.post("/run_analysis_script")
def run_analysis_script(
    workflow_id: int = Body(...),
    script: str = Body(...),
    script_type: str = Body(...),
    db: Session = Depends(get_db)
):
    # Load workflow
    w = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not w or not w.data_prep:
        return {"error": "Workflow or data not found"}
    try:
        parsed = json.loads(w.data_prep)
        sources = parsed.get("sources", [])
        saved_queries = parsed.get("savedQueries", [])
        # Prepare dataframes
        dataframes = {}
        for src in sources:
            if not src.get("filePath"):
                continue
            filename = src["filePath"].split("/")[-1]
            file_path = os.path.join(UPLOAD_DIR, filename)
            if not os.path.exists(file_path):
                continue
            df = pd.read_excel(file_path)
            dataframes[src["tableName"]] = df
        # Prepare query outputs
        query_outputs = {}
        for q in saved_queries:
            try:
                if q["type"] == "sql":
                    # Run SQL on all dataframes, store result as df_{q['name']}
                    for df_name, df in dataframes.items():
                        try:
                            result = pd.read_sql_query(q["query"], con=create_engine(f'sqlite:///:memory:'))
                            query_outputs[q["name"]] = result
                        except Exception:
                            continue
                # Python queries not supported for auto-execution yet
            except Exception:
                continue
        # Run the analysis script
        if script_type == "sql":
            # Use pandasql to run SQL on all dataframes
            try:
                result = pandasql.sqldf(script, dataframes)
                return {"result": result.to_dict(orient="records")}
            except Exception as e:
                return {"error": str(e), "trace": traceback.format_exc()}
        elif script_type == "python":
            # Provide dataframes and query_outputs as locals
            local_vars = {**dataframes, **query_outputs}
            try:
                exec_globals = {}
                exec(script, exec_globals, local_vars)
                # Return all dataframes/outputs as dicts
                output = {k: v.to_dict(orient="records") for k, v in local_vars.items() if isinstance(v, pd.DataFrame)}
                return {"result": output}
            except Exception as e:
                return {"error": str(e), "trace": traceback.format_exc()}
        else:
            return {"error": "Unknown script type"}
    except Exception as e:
        return {"error": str(e), "trace": traceback.format_exc()}