import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


@dataclass(frozen=True)
class JWTSettings:
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int


def get_jwt_settings() -> JWTSettings:
    secret = os.environ.get("JWT_SECRET_KEY", "").strip()
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not set")

    algorithm = os.environ.get("JWT_ALGORITHM", "HS256").strip()
    minutes_raw = os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30").strip()
    try:
        minutes = int(minutes_raw)
    except ValueError as e:
        raise RuntimeError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be an integer") from e

    return JWTSettings(
        secret_key=secret,
        algorithm=algorithm,
        access_token_expire_minutes=minutes,
    )


if __name__ == "__main__":
    jwt_cfg = get_jwt_settings()
    print(jwt_cfg)
