const fs = require('fs');
const path = 'e:/Angel-Pet-Clone_DZ/src/App.tsx';
let c = fs.readFileSync(path, 'utf8');

const OLD = `<Route path="/settings/authority" element={<AdminRoute><AuthorityPage key={\`authority-\${refreshKey}\`} /></AdminRoute>} />`;
const NEO = OLD + `
          <Route path="/gst-exempt-sales" element={<AdminRoute><GstExemptSales key={\`gst-\${refreshKey}\`} onOpenRecordPaymentModal={(id) => openRecordPayment(id)} onOpenNewDispatchModal={(id) => openNewDispatch(id)} /></AdminRoute>} />`;

if (!c.includes(OLD)) {
  console.error('Pattern not found in App.tsx. Printing context...');
  const idx = c.indexOf('settings/authority');
  console.log(JSON.stringify(c.substring(Math.max(0,idx-20), idx+100)));
  process.exit(1);
}

fs.writeFileSync(path, c.replace(OLD, NEO), 'utf8');
console.log('OK - route added');
