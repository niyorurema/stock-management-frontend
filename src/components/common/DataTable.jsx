import React, { useState } from 'react';

function DataTable({ columns, data, loading, onRowClick }) {
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal || '').localeCompare(String(bVal || ''));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortField, sortDirection]);

  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  if (loading) {
    return <div className="table-loading">Chargement...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="table-empty">Aucune donnée disponible</div>;
  }

  return (
    <div className="data-table-container">
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx}
                  onClick={() => col.sortable && handleSort(col.selector)}
                  style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                >
                  {col.name}
                  {col.sortable && sortField === col.selector && (
                    <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr 
                key={idx} 
                onClick={() => onRowClick && onRowClick(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx}>
                    {col.cell ? col.cell(row) : row[col.selector]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="table-pagination">
          <button 
            onClick={() => setCurrentPage(1)} 
            disabled={currentPage === 1}
          >
            «
          </button>
          <button 
            onClick={() => setCurrentPage(p => p - 1)} 
            disabled={currentPage === 1}
          >
            ‹
          </button>
          <span>
            Page {currentPage} sur {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => p + 1)} 
            disabled={currentPage === totalPages}
          >
            ›
          </button>
          <button 
            onClick={() => setCurrentPage(totalPages)} 
            disabled={currentPage === totalPages}
          >
            »
          </button>
          <select 
            value={rowsPerPage} 
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10 lignes</option>
            <option value={25}>25 lignes</option>
            <option value={50}>50 lignes</option>
            <option value={100}>100 lignes</option>
          </select>
        </div>
      )}

      <style>{`
        .data-table-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .table-responsive {
          overflow-x: auto;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .data-table thead tr {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .data-table th {
          padding: 14px 16px;
          text-align: left;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
        }
        .data-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }
        .data-table tbody tr:hover {
          background: #f1f5f9;
        }
        .sort-icon {
          font-size: 12px;
          margin-left: 4px;
          color: #64748b;
        }
        .table-pagination {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .table-pagination button {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .table-pagination button:hover:not(:disabled) {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }
        .table-pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .table-pagination select {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          margin-left: 8px;
        }
        .table-loading, .table-empty {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}

export default DataTable;