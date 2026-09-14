from uuid import UUID

from pydantic import BaseModel


class LoginRequest(BaseModel):
    identifier: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    account_type: str
    role_key: str
    role_name: str
    is_active: bool
    must_change_password: bool

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: CurrentUserResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    def validate_strength(self) -> None:
        if len(self.new_password) < 8:
            raise ValueError("New password must be at least 8 characters.")


class ChangePasswordResponse(BaseModel):
    message: str = "Password changed successfully."
