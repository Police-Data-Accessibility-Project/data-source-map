venv:
	virtualenv venv; \
	. venv/bin/activate; \
	pip install -r requirements.txt;
	echo "export FLASK_APP=app" >> venv/bin/activate

db:
	psql -c "DROP DATABASE pdap_dataset_catalog"
	psql -c "CREATE DATABASE pdap_dataset_catalog"
	flask db upgrade

