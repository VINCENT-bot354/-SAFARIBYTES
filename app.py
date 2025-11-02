@app.route('/api/orders', methods=['GET', 'POST'])
def orders():
    if request.method == 'GET':
        orders_list = Order.query.order_by(Order.created_at.desc()).all()
        return jsonify([{
            'id': o.id,
            'order_id': o.order_id,
            'customer_name': o.customer_name,
            'customer_phone': o.customer_phone,
            'customer_email': o.customer_email,
            'items': o.items,
            'product_total': o.product_total,
            'delivery_fee': o.delivery_fee,
            'total_amount': o.total_amount,
            'payment_method': o.payment_method,
            'payment_status': o.payment_status,
            'delivery_address': o.delivery_address,
            'staff_id': o.staff_id,
            'staff_name': o.staff.full_name if o.staff else 'Unassigned',
            'status': o.status,
            'created_at': o.created_at.isoformat()
        } for o in orders_list])
    # ... rest of the function unchanged ...