import requests
import random

options = ['a', 'b']

# Send 100 random votes to the vote app
for i in range(100):
    vote = random.choice(options)
    requests.post('http://vote/', data={'vote': vote})
    print(f"Voted {vote}")