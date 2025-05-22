export const TableManager = {
  tbody: document.querySelector("#inputTable tbody"),

  addRow(name = "", code = "", qty = "", avg = "") {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${name}"></td>
      <td><input type="text" value="${code}"></td>
      <td><input type="number" value="${qty}"></td>
      <td><input type="number" value="${avg}"></td>
      <td><button class="btn btn-del del">×</button></td>`;
    this.tbody.appendChild(tr);
  },

  getRows() {
    return [...this.tbody.querySelectorAll("tr")].map(tr => {
      const [n, c, q, a] = tr.querySelectorAll("input");
      return {
        name: n.value.trim(),
        code: c.value.trim(),
        qty: +q.value,
        avg: +a.value
      };
    }).filter(r => r.name && r.code && r.qty && r.avg);
  },

  init() {
    document.getElementById("addBtn").onclick = () => this.addRow();
    this.tbody.onclick = e => {
      if (e.target.classList.contains("del")) e.target.closest("tr").remove();
    };
  }
}; 