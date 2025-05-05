import AadhaarOCR from './Components/AadhaarOCR';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <div >
      <ToastContainer />
      <AadhaarOCR/>
    </div>
  );
}

export default App;