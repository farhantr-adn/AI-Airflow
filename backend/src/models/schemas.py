"""Pydantic request/response schemas."""
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "developer"
    auth_provider: str = "jwt"
    created_at: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class RepoConnectIn(BaseModel):
    provider: str  # github | gitlab | bitbucket
    url: str


class RepoOAuthMockIn(BaseModel):
    provider: str


class PipelineGenIn(BaseModel):
    repo_id: str
    target_platform: str  # github-actions | gitlab-ci | jenkins | bitbucket
    cloud_target: str
    deploy_strategy: str
    test_coverage: int = 80
    enable_security: bool = True
    enable_monitoring: bool = True
    model: str = "claude-sonnet-4-5-20250929"
    provider: str = "anthropic"
    extra_requirements: str = ""


class PipelineSaveIn(BaseModel):
    repo_id: str
    name: str
    target_platform: str
    cloud_target: str
    deploy_strategy: str
    yaml_content: str
    model: str
    provider: str
    stages: List[str]


class AutoFixIn(BaseModel):
    model: str = "claude-sonnet-4-5-20250929"
    provider: str = "anthropic"
