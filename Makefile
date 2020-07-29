venv:
	virtualenv venv; \
	. venv/bin/activate; \
	pip install -r requirements.txt;
	export FLASK_APP=app

db:
	psql -c "DROP DATABASE pdap_dataset_catalog"
	psql -c "CREATE DATABASE pdap_dataset_catalog"
	flask db upgrade

