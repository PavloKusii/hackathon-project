import { Link } from 'react-router-dom';

function Navbar() {
    return (
        <nav style={{ padding: '1rem', background: '#1e293b', color: '#fff' }}>
            <h2 style={{ margin: 0, marginBottom: '10px' }}>Панель адміністратора</h2>
            <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', padding: 0, margin: 0 }}>
                <li>
                    <Link to="/" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>Головна</Link>
                </li>
                <li>
                    <Link to="/tests" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>Тести</Link>
                </li>
            </ul>
        </nav>
    );
}

export default Navbar;