const nombres = { administrador: 'Administrador del sistema', emprendimiento: 'Emprendimiento', cliente: 'Cliente' }
const acciones = [
  ['productos.ver', 'Consultar'],
  ['productos.crear', 'Crear'],
  ['productos.editar', 'Editar'],
  ['productos.publicar', 'Publicar'],
]

export function Marca() {
  return <span className="brand-lockup"><span className="brand-symbol" aria-hidden="true">e<span>g</span></span><span>EmpreGest<span className="brand-dot">.</span></span></span>
}

export function InsigniaRol({ rol, habilitada = true }) {
  return <span className={'role-badge role-' + (habilitada ? rol : 'inactiva')}><span aria-hidden="true" className="role-dot" />{habilitada ? nombres[rol] ?? 'Comprobando acceso' : 'Cuenta no habilitada'}</span>
}

export function PermisosResumen({ permisos = [] }) {
  return <ul className="permission-list" aria-label="Permisos sobre productos">{acciones.map(([clave, nombre]) => {
    const permitido = permisos.includes(clave)
    return <li key={clave} className={permitido ? 'permission-on' : 'permission-off'}><span aria-hidden="true">{permitido ? '✓' : '—'}</span> {nombre}<span className="sr-only">: {permitido ? 'permitido' : 'sin permiso'}</span></li>
  })}</ul>
}
