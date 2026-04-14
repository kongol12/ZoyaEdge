import CSVUploader from '../../components/organisms/client/CSVUploader';

export default function ImportTrades() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-poppins font-black tracking-tight text-gray-900 dark:text-white">Import Trades</h1>
        <p className="text-gray-500 dark:text-gray-400">Upload your MT5 history export (CSV) to automatically log your trades.</p>
      </div>
      <CSVUploader />
    </div>
  );
}
