interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'yellow' | 'green' | 'red' | 'blue';
}

const colorClasses = {
  yellow: 'bg-plex-yellow text-plex-darker',
  green: 'bg-green-500 text-white',
  red: 'bg-red-500 text-white',
  blue: 'bg-blue-500 text-white',
};

export default function StatCard({ title, value, icon, color = 'yellow' }: StatCardProps) {
  return (
    <div className="bg-plex-dark rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
