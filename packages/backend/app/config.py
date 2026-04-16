from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://fieldwatch:fieldwatch@localhost:5432/fieldwatch"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = "change-me-in-production-replace-me!!"
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = "fieldwatch-uploads"
    aws_region: str = "eu-north-1"
    nominatim_user_agent: str = "fieldwatch-dev"
    firebase_credentials_json: str = "{}"  # JSON string of Firebase service account key
    gemini_api_key: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_must_be_strong(cls, v: str) -> str:
        if v == "change-me-in-production":
            import os
            if os.getenv("ENVIRONMENT", "development") == "production":
                raise ValueError("JWT_SECRET must be changed from the default in production")
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    class Config:
        env_file = ".env"


settings = Settings()
