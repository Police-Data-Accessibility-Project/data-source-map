from app import db
from sqlalchemy.dialects.postgresql import UUID

import uuid

class Dataset(db.Model):
    __tablename__ = 'datasets'

    id = db.Column(UUID, primary_key=True, default=lambda:uuid.uuid4().hex)
    name = db.Column(db.String)
