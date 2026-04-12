FROM python:3.9-slim
WORKDIR /seed
COPY . .
RUN pip install requests
CMD ["python", "make-data.py"]