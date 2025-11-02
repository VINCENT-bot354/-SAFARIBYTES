# Updated app.py

# This update removes the is_archived filter from the /api/orders endpoint to return all orders.

@app.route('/api/orders', methods=['GET'])
def get_orders():
    # Fetch orders without the is_archived filter
    orders = Order.query.all()  # Retrieve all orders
    return jsonify([order.to_dict() for order in orders])