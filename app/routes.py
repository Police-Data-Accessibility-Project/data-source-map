from app import app
from app.models import Dataset

from flask import render_template, jsonify
import csv

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    datasets = Dataset.query.all()
    values = []
    for dataset in datasets:
        row = ['']*12
        row[0] = dataset.state.name
        row[1] = dataset.county.name
        row[4] = dataset.source_url
        values.append(row)
    return jsonify({'values': values})
