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
    output_format: str = "yaml"  # yaml | scripts | terraform | cloudformation
    model: str = "claude-sonnet-4-5-20250929"
    provider: str = "anthropic"
    extra_requirements: str = ""
    # Bring-your-own-key path (optional)
    api_key_id: Optional[str] = None  # id of a saved user api key
    custom_model: Optional[str] = None  # overrides `model` when using user key


class ApiKeyIn(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    mode: str  # openai | anthropic | openai-compat
    api_key: str = Field(min_length=8)
    base_url: Optional[str] = None  # required for openai-compat
    default_model: Optional[str] = None  # e.g. "gpt-4o", "claude-3-5-sonnet-20241022", "llama-3.1-70b-versatile"


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
