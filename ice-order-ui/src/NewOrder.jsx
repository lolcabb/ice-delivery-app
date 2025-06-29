// 📁 File: NewOrder.js (Corrected CSS Grid for Product Alignment)
import React, { useState, useRef, useEffect } from 'react';
import { apiService } from './apiService'; // Adjust the import based on your project structure

// Define the product names mapping
const productNames = {
  A: 'น้ำแข็งหลอด',
  B: 'น้ำแข็งบด',
  C: 'น้ำแข็งหลอดเล็ก',
  D: 'น้ำแข็งซอง',
  E: 'น้ำแข็งกั๊ก'
};
const productKeys = Object.keys(productNames); // ['A', 'B', 'C', 'D', 'E']

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'; //var env

// Default initial state for the form
const initialFormState = {
  customerName: '', address: '', phone: '', driverName: '', issuer: '',
  products: {
    A: { price: '', quantity: '' }, B: { price: '', quantity: '' }, C: { price: '', quantity: '' },
    D: { price: '', quantity: '' }, E: { price: '', quantity: '' }
  }
};

export default function NewOrder({ onOrderCreated }) {
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const customerNameInputRef = useRef(null);

  useEffect(() => {
    customerNameInputRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleProductChange = (e, key, field) => {
    const { value } = e.target;
    let processedValue = value;
    if (field === 'price' || field === 'quantity') {
        if (value !== '') {
            const num = parseFloat(value);
            // Allow 0 but not negative numbers or NaN
            if (isNaN(num) || num < 0) {
                processedValue = ''; // Reset if invalid
            }
        }
    }
    setForm(prevForm => ({
      ...prevForm,
      products: {
        ...prevForm.products,
        [key]: { ...prevForm.products[key], [field]: processedValue }
      }
    }));
  };


  const resetForm = () => {
    setForm(initialFormState);
    setError('');
    console.log("Form reset.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // --- Validation ---
    for (const key of productKeys) {
        const product = form.products[key];
        const productName = productNames[key];
        const priceStr = String(product.price).trim();
        const quantityStr = String(product.quantity).trim();
        const priceEntered = priceStr !== '';
        const quantityEntered = quantityStr !== '';

        // Check if one is entered but not the other
        if (priceEntered !== quantityEntered) {
             setError(`${productName}: กรุณากรอกทั้งราคาและจำนวน หรือล้างข้อมูลทั้งสองช่อง`);
             setLoading(false); return;
        }

        // If both are entered, validate quantity > 0 and price >= 0
        if (priceEntered && quantityEntered) {
            const quantityValue = parseFloat(quantityStr);
            const priceValue = parseFloat(priceStr); // Also parse price for validation

            if (isNaN(quantityValue) || quantityValue <= 0) {
                setError(`${productName}: จำนวนต้องมากกว่า 0`);
                setLoading(false); return;
            }
            // Also check if price is valid (though handleProductChange already tries)
             if (isNaN(priceValue) || priceValue < 0) {
                setError(`${productName}: ราคาต้องเป็นตัวเลขที่ไม่ติดลบ`);
                setLoading(false); return;
             }
        }
    }


    // Process and filter valid order items
    const orderItems = Object.entries(form.products)
      .map(([productKey, val]) => {
            const priceStr = String(val.price).trim();
            const quantityStr = String(val.quantity).trim();
            // Ensure we parse only non-empty strings
            const quantity = quantityStr !== '' ? parseFloat(quantityStr) : NaN;
            const pricePerUnit = priceStr !== '' ? parseFloat(priceStr) : NaN;

            // Define validity based on parsed numbers
            const isValidQuantity = !isNaN(quantity) && quantity > 0;
            const isValidPrice = !isNaN(pricePerUnit) && pricePerUnit >= 0; // Price can be 0
            const wasEntered = priceStr !== '' && quantityStr !== ''; // Both fields had some input

            return {
                productType: productNames[productKey],
                quantity: quantity,
                pricePerUnit: pricePerUnit,
                isValid: wasEntered && isValidQuantity && isValidPrice, // Combined validity check
            };
        })
      .filter(item => item.isValid) // Filter based on the combined validity
      .map(item => ({ // Map to final structure AFTER filtering
          productType: item.productType,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalAmount: item.quantity * item.pricePerUnit
      }));


    // Standard field validation
    if (!form.customerName.trim()) { setError('กรุณากรอกชื่อลูกค้า'); setLoading(false); return; }
    if (orderItems.length === 0) { console.log("Validation Error: Filtered order items resulted in empty array. Raw form products state:", form.products); setError('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ โดยมีราคาและจำนวนที่ถูกต้อง (ราคาต้องไม่ติดลบ, จำนวนต้องมากกว่า 0)'); setLoading(false); return; }
    if (!form.issuer.trim()) { setError('กรุณากรอกชื่อผู้ออกบิล'); setLoading(false); return; }
    // --- End Validation ---

    const payload = {
        customerName: form.customerName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        driverName: form.driverName.trim(),
        issuer: form.issuer.trim(),
        status: 'Created',
        orderItems: orderItems
    };

    // --- API Call & Post-Submit Actions ---
    try {
       const createdOrderData = await apiService.post('/orders', payload);

       if (!createdOrderData || !createdOrderData.id || !createdOrderData.status) {
           throw new Error('สร้างคำสั่งซื้อแล้ว แต่ข้อมูลที่ได้รับกลับมาจากเซิร์ฟเวอร์ไม่สมบูรณ์หรือไม่ถูกต้อง');
       }

       console.log(`สร้างคำสั่งซื้อ #${createdOrderData.id} สำเร็จแล้ว`);
       resetForm();

       if (onOrderCreated) {
            console.log("Calling onOrderCreated callback...");
            onOrderCreated(createdOrderData);
       }

       let printBaseUrl;
       try {
           // Example: API_BASE_URL = 'https://phayayenice.com/api'
           const urlObject = new URL(API_BASE_URL);
           // urlObject.protocol -> "https:"
           // urlObject.host -> "phayayenice.com"
           // This correctly constructs "https://phayayenice.com"
           printBaseUrl = `${urlObject.protocol}//${urlObject.host}`;
       } catch (e) {
           console.error("Could not parse API_BASE_URL to create print URL:", API_BASE_URL, e);
           printBaseUrl = ''; // Fallback
       }

       if (printBaseUrl) {
           // Constructs "https://phayayenice.com/print-bill/..."
           const printUrl = `${printBaseUrl}/print-bill/${createdOrderData.id}`;
           console.log("Opening print window:", printUrl);
           const win = window.open(printUrl, '_blank');
           if (!win) {
               alert('ระบบพยายามเปิดหน้าพิมพ์บิลอัตโนมัติ กรุณาอนุญาต popups สำหรับเว็บไซต์นี้หากถูกปิดกั้น');
           }
       } else {
            // Handle the error if printBaseUrl couldn't be determined
            setError("Could not determine the correct print URL.");
            console.error("Failed to create printBaseUrl from API_BASE_URL:", API_BASE_URL);
       }

       setTimeout(() => {
           customerNameInputRef.current?.focus();
           console.log("Attempted delayed focus on customer name input.");
       }, 300);

     } catch (err) {
         console.error("Order submission error:", err);
         setError(err.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างการส่งคำสั่งซื้อ');
     } finally {
         setLoading(false);
         console.log("Loading state set to false.");
     }
  };

  // --- JSX Structure ---
  return (
    <div className="p-3 w-[420px] bg-gray-50 rounded-md shadow-sm mx-auto border border-gray-200 my-4">
      <h2 className="text-base font-semibold mb-3 text-gray-700 text-center">ออกบิลใหม่</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Customer/Address/Phone Inputs */}
        <input
            ref={customerNameInputRef}
            type="text" name="customerName" placeholder="ชื่อลูกค้า *" aria-label="Customer Name"
            className="w-full border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150"
            value={form.customerName} onChange={handleChange} required
        />
        <input type="text" name="address" placeholder="ที่อยู่ (Optional)" aria-label="Address" className="w-full border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150" value={form.address} onChange={handleChange} />
        <input type="tel" name="phone" placeholder="เบอร์ (Optional)" aria-label="Phone" className="w-full border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150" value={form.phone} onChange={handleChange} />

        {/* --- CORRECTED: Product Section using CSS Grid --- */}
        <div className="pt-1">
             {/* Grid Container for headers and rows */}
             {/* Define 3 columns: Label (flexible), Price (80px), Quantity (80px) */}
             {/* Use explicit pixel widths for input columns for robustness */}
             {/* `items-start` aligns items to the top of their grid cell */}
             <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] gap-x-2 gap-y-1 items-start"> {/* Changed items-center to items-start */}
                 {/* Header Row - these are direct children and will occupy the first 3 grid cells */}
                 <div className="text-xs font-medium text-gray-500 text-left pb-1">สินค้า</div> {/* Added padding-bottom */}
                 <div className="text-xs font-medium text-gray-500 text-right pb-1">ราคาหน่วย</div> {/* Added padding-bottom */}
                 <div className="text-xs font-medium text-gray-500 text-right pb-1">จำนวน</div> {/* Added padding-bottom */}

                 {/* Product Input Rows (Mapped) */}
                 {productKeys.map((key) => (
                    // Use React.Fragment: Label, Price Input, Quantity Input become the next 3 grid items, filling the row.
                    <React.Fragment key={key}>
                        {/* Column 1: Label */}
                        <label
                            htmlFor={`price-${key}`} // Associates label with price input for accessibility
                            // Align self to center vertically within the grid cell if needed (usually start is fine)
                            className="text-sm font-medium text-gray-700 text-left self-center"
                        >
                            {productNames[key]}
                        </label>

                        {/* Column 2: Price Input */}
                        <input
                            type="number" id={`price-${key}`}
                            placeholder="0.00" min="0" step="any"
                            value={form.products[key].price}
                            onChange={(e) => handleProductChange(e, key, 'price')}
                            aria-label={`ราคาของ${productNames[key]}`}
                            className="border border-gray-300 p-1 rounded text-sm shadow-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150 w-full" // Use w-full to fill grid cell
                         />

                         {/* Column 3: Quantity Input */}
                         <input
                            type="number" id={`qty-${key}`} // Changed id to match label's htmlFor if needed, or keep separate
                            placeholder="0" min="1" step="any" // Quantity typically starts at 1 if entered, or use min="0" if 0 is allowed via typing
                            value={form.products[key].quantity}
                            onChange={(e) => handleProductChange(e, key, 'quantity')}
                            aria-label={`จำนวนของ${productNames[key]}`}
                            className="border border-gray-300 p-1 rounded text-sm shadow-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150 w-full" // Use w-full to fill grid cell
                         />
                     </React.Fragment>
                 ))}
             </div> {/* End Grid Container */}
         </div>
        {/* --- End Product Section --- */}

        {/* Driver/Issuer Inputs */}
        <div className="pt-1 space-y-2">
             <input type="text" name="driverName" placeholder="คนขับ (Optional)" aria-label="Driver" className="w-full border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150" value={form.driverName} onChange={handleChange} />
             <input type="text" name="issuer" placeholder="ผู้ออกบิล *" aria-label="Issuer" className="w-full border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors duration-150" value={form.issuer} onChange={handleChange} required />
        </div>

        {/* Error display area */}
        {error && <p className="text-red-600 text-xs text-center pt-1">{error}</p>}

        {/* Submit Button */}
        <button type="submit" disabled={loading} className="w-full bg-gradient-to-b from-blue-500 to-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150 ease-in-out" >
          {loading ? 'กำลังออกบิล...' : 'ออกบิล & ปริ้นท์'}
        </button>
      </form>
    </div>
  );
}
