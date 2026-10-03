// Sample frontend: the sales page (frontend handoff: GET /api/sales/).
fetch('/api/sales/')
  .then((r) => r.json())
  .then((sales) => {
    if (!sales.length) {
      document.getElementById('empty').hidden = false;
      return;
    }
    const body = document.querySelector('#sales tbody');
    for (const s of sales) {
      const tr = document.createElement('tr');
      for (const v of [s.student, s.quantity, s.unit_price, s.total]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    document.getElementById('sales').hidden = false;
  });
