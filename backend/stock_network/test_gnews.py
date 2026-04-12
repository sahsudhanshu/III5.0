from gnews import GNews

gn = GNews(language="en", country="US", max_results=2)
results = gn.get_news("Apple stock")
print("RESULTS:", results)
