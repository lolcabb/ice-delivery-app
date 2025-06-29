// Utility functions for date formatting and manipulation

export const formatDateForInput = (dateValue) => {
    if (!dateValue && dateValue !== 0) { // Handles null, undefined, empty string, but allows 0 for timestamp
        return '';
    }

    try {
        let d;
        // If dateValue is already a YYYY-MM-DD string,
        // parse it carefully to ensure it's treated as local.
        // new Date('YYYY-MM-DD') might interpret it as UTC midnight.
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            const parts = dateValue.split('-');
            // Month is 0-indexed in JS Date constructor (year, monthIndex, day)
            // This explicitly creates a date at local midnight for the given calendar date.
            d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            // Handles JS Date objects, full ISO strings (which include timezone or are UTC),
            // and numeric timestamps.
            d = new Date(dateValue);
        }

        if (isNaN(d.getTime())) { // Check if the parsed date is valid
            console.warn("Invalid dateValue received by formatDateForInput:", dateValue);
            return '';
        }
        // 'en-CA' locale consistently formats to YYYY-MM-DD
        // using the local timezone interpretation of the Date object 'd'.
        return d.toLocaleDateString('en-CA');
    } catch (e) {
        console.error("Error formatting date for input:", dateValue, e);
        return ''; // Return empty string or handle error as appropriate
    }
};

export const getCurrentLocalDateISO = () => {
    return new Date().toLocaleDateString('en-CA');
};

export const getCurrentLocalMonthISO = () => {
    return new Date().toLocaleDateString('en-CA').slice(0, 7); // Returns "YYYY-MM"
};

export const formatDisplayDate = (dateValue, locale = 'th-TH', options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!dateValue && dateValue !== 0) return 'N/A';
    try {
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString(locale, options);
    } catch (e) {
        return 'Invalid Date';
    }
};