import csv
from app import db
from app.models import Dataset, County, State

if __name__ == '__main__':
    with open('Counties To Scrape.csv') as f:
        reader = csv.reader(f)
        # Skip header
        next(reader, None)
        for row in reader:
            print('State: {} County:{} URL:{}'.format(row[0], row[1], row[4]))
            state = State.query.filter_by(name=row[0]).first()
            if state is None:
                state = State(name=row[0])
                db.session.add(state)

            county = County.query.filter_by(name=row[1]).first()
            if county is None:
                county = County(name=row[1], state=state)
                db.session.add(county)

            dataset = Dataset(state=state, county=county, source_url=row[4])
            db.session.add(dataset)

    db.session.commit()
