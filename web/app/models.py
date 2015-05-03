from app import db
from flask.ext.login import UserMixin
from social.apps.flask_app.default import models
import datetime

ROLE = {'user': 0, 'admin': 1}
STATUS = {'regular': 0, 'banned': 1}

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(200))
    email = db.Column(db.String, index=True, unique=True)
    role = db.Column(db.SmallInteger, default=ROLE['user'])
    status = db.Column(db.SmallInteger, default=STATUS['regular'])
    last_seen = db.Column(db.DateTime)

    def is_admin(self):
        return self.role == ROLE['admin']

    def is_active(self):
        return self.status == STATUS['regular']

    def __repr__(self):
        return '<User %r>' % self.email
