from app import db
from sqlalchemy.dialects.postgresql import UUID

import uuid

class Dataset(db.Model):
    __tablename__ = 'datasets'

    id = db.Column(UUID, primary_key=True, default=lambda:uuid.uuid4().hex)
    name = db.Column(db.String)
    source_url = db.Column(db.String)
    county_id = db.Column(UUID, db.ForeignKey('counties.id'))
    state_id = db.Column(UUID, db.ForeignKey('states.id'))
    county = db.relationship('County', backref='datasets')
    state = db.relationship('State', backref='datasets')

class County(db.Model):
    __tablename__ = 'counties'

    id = db.Column(UUID, primary_key=True, default=lambda:uuid.uuid4().hex)
    name = db.Column(db.String, nullable=False)
    state_id = db.Column(UUID, db.ForeignKey('states.id'))
    state = db.relationship('State', backref='counties')

    def __repr__(self):
        return '<County: {}>'.format(self.name)

class State(db.Model):
    __tablename__ = 'states'

    id = db.Column(UUID, primary_key=True, default=lambda:uuid.uuid4().hex)
    name = db.Column(db.String, nullable=False)

    def __repr__(self):
        return '<State: {}>'.format(self.name)

