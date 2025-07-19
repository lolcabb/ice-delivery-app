export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) {
        return '฿0.00';
    }
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 2
    }).format(amount);
};
