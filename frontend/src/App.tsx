import { useState, useEffect } from 'react'

interface Producto {
  id: number;
  nombre: string;
  precio_venta_mayorista: number;
  stock_actual: number;
  codigo_interno: string;
}

function App() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<{producto: Producto, cantidad: number}[]>([]);

  // Llamada al Backend del Mayorista EK (Puerto 3001)
  useEffect(() => {
    fetch('http://localhost:3001/api/catalogo/productos')
      .then(res => res.json())
      .then(data => setProductos(data))
      .catch(err => console.error("Error de conexión:", err));
  }, []);

  const agregar = (p: Producto) => {
    setCarrito(prev => {
      const item = prev.find(i => i.producto.id === p.id);
      return item 
        ? prev.map(i => i.producto.id === p.id ? {...i, cantidad: i.cantidad + 1} : i)
        : [...prev, { producto: p, cantidad: 1 }];
    });
  };

  return (
    <div className="min-h-screen p-6">
      <header className="flex justify-between items-center mb-8 bg-blue-800 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-3xl font-black">EK MAYORISTA</h1>
          <p className="text-blue-200">Panel de Preventa Local</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold">🛒 {carrito.length}</span>
          <p className="text-xs uppercase tracking-widest">Productos</p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Grilla de Golosinas */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {productos.map(p => (
            <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 transition-all">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 text-lg">{p.nombre}</h3>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded font-mono">{p.codigo_interno}</span>
              </div>
              <p className="text-3xl font-black text-blue-600 mb-1">${p.precio_venta_mayorista}</p>
              <p className="text-sm text-slate-400 mb-4 italic">Stock disponible: {p.stock_actual}</p>
              <button 
                onClick={() => agregar(p)}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                Añadir al Pedido
              </button>
            </div>
          ))}
        </div>

        {/* Resumen de Venta */}
        <div className="w-full lg:w-96 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 h-fit sticky top-6">
          <h2 className="text-xl font-bold mb-4 text-slate-800 border-b pb-4">Detalle del Pedido</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
            {carrito.map(item => (
              <div key={item.producto.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-700">{item.producto.nombre}</p>
                  <p className="text-xs text-slate-400">Cant: {item.cantidad}</p>
                </div>
                <p className="font-bold text-slate-900">${(item.producto.precio_venta_mayorista * item.cantidad).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between text-2xl font-black text-slate-900">
              <span>TOTAL</span>
              <span>${carrito.reduce((acc, curr) => acc + (curr.producto.precio_venta_mayorista * curr.cantidad), 0).toFixed(2)}</span>
            </div>
            <button className="w-full mt-6 bg-green-500 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-green-200 hover:bg-green-600 transition-all uppercase tracking-tight">
              Confirmar Venta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
