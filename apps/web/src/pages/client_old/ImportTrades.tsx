import CSVUploader from '@shared/components/organisms/client/CSVUploader';

export default function ImportTrades() {
  return (
    <div className="max-w-4xl mx-auto w-full pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-poppins font-black tracking-tight text-gray-900 dark:text-white">Import Trades</h1>
        <p className="text-gray-500 dark:text-gray-400">Choisissez votre plateforme et importez votre historique de trading pour analyser vos performances.</p>
      </div>
      <CSVUploader />
    </div>
  );
}
