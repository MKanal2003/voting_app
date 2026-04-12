from flask import Flask, render_template, request, make_response, g
from redis import Redis
import os
import socket
import random
import json

# Read vote options from environment variables
# If not set, default to "Cats" and "Dogs"
option_a = os.getenv('OPTION_A', "Cats")
option_b = os.getenv('OPTION_B', "Dogs")

# Get the container's hostname (used to show which server handled the request)
hostname = socket.gethostname()

app = Flask(__name__)

def get_redis():
    # Store redis connection on Flask's 'g' object (lives for one request)
    if not hasattr(g, 'redis'):
        g.redis = Redis(host="redis", db=0, socket_timeout=5)
    return g.redis

@app.route("/", methods=['POST', 'GET'])
def hello():
    # Get voter_id from cookie, or create a new random one
    voter_id = request.cookies.get('voter_id')
    if not voter_id:
        voter_id = hex(random.getrandbits(64))[2:-1]

    vote = None

    if request.method == 'POST':
        redis = get_redis()
        vote = request.form['vote']   # 'a' or 'b'
        # Pack the vote as JSON and push it onto the Redis list
        data = json.dumps({'voter_id': voter_id, 'vote': vote})
        redis.rpush('votes', data)

    # Build the response with the HTML template
    resp = make_response(render_template(
        'index.html',
        option_a=option_a,
        option_b=option_b,
        hostname=hostname,
        vote=vote,
    ))
    # Save voter_id in a cookie so the same browser always has the same ID
    resp.set_cookie('voter_id', voter_id)
    return resp