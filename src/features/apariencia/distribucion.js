export function ordenarProductos(productos,orden=[]){
 const posiciones=new Map((Array.isArray(orden)?orden:[]).map((id,i)=>[String(id),i]))
 return [...productos].sort((a,b)=>(posiciones.get(String(a.id))??Infinity)-(posiciones.get(String(b.id))??Infinity)||Number(a.id)-Number(b.id))
}
export function moverProducto(productos,orden,id,direccion){
 const ids=ordenarProductos(productos,orden).map(p=>p.id),i=ids.findIndex(p=>String(p)===String(id)),j=i+direccion
 if(i>=0&&j>=0&&j<ids.length)[ids[i],ids[j]]=[ids[j],ids[i]]
 return ids
}
