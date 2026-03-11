const STOCK_API_URL = "https://script.google.com/macros/s/AKfycbx1T7J7RRslouJ3l03rXY7VPVloW-MUrvV_mbj5GlRWRxSv8XnR2osWYydwnfKo05YISA/exec";

async function testStockSync() {
  const response = await fetch(STOCK_API_URL);
  const data = await response.json();
  console.log("Stock API OK:", data);
  return data;
}
