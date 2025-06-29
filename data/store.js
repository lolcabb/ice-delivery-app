let users = [
    { id: 1, email: 'admin@example.com', password: 'admin123', role: 'admin' },
    { id: 2, email: 'manager@example.com', password: 'manager123', role: 'manager' },
    { id: 3, email: 'front@example.com', password: 'front123', role: 'front' },
  ];
  
  let orders = [];
  let orderIdCounter = 1;
  
  module.exports = {
    users,
    orders,
    getNextOrderId: () => orderIdCounter++,
  };

  let activityLogs = [];

function logActivity({ userId, action, orderId, field, oldValue, newValue }) {
  activityLogs.push({
    timestamp: new Date(),
    userId,
    action,
    orderId,
    field,
    oldValue,
    newValue
  });
}

module.exports = {
  users,
  orders,
  activityLogs,
  logActivity,
  getNextOrderId: () => orderIdCounter++
};
