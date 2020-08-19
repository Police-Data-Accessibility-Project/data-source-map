from app import app

from flask import render_template, jsonify
import csv

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    with open('Counties To Scrape.csv') as f:
        reader = csv.reader(f)
        return jsonify({'values': list(reader)})
