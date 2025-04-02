import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get port from environment or use default
PORT = int(os.getenv("PORT", "8000"))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
