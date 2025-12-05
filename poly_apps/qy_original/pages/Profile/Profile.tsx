
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';

const ProfilePage = () => {
  const { user, navigate } = useContext(AppContext);
  return (
    <div className="h-full flex flex-col p-4 pt-12 animate-slide-up">
       <div className="flex items-center gap-3 mb-6">
         <button onClick={() => navigate('settings')} className="p-1"><Icons.Back /></button>
         <h1 className="text-xl font-bold dark:text-white">Edit Profile</h1>
       </div>

       <div className="flex flex-col items-center mb-8">
          <div className="relative">
             <img src={user?.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-lg" />
             <button className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full shadow-md"><Icons.Settings /></button>
          </div>
          <h2 className="text-xl font-bold mt-4 dark:text-white">{user?.name}</h2>
          <p className="text-slate-500">{user?.email}</p>
       </div>

       <div className="space-y-4">
          <div className="space-y-1">
             <label className="text-sm font-bold text-slate-500 uppercase">Display Name</label>
             <input type="text" defaultValue={user?.name} className="w-full p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-transparent focus:border-blue-400 outline-none dark:text-white" />
          </div>
          <div className="space-y-1">
             <label className="text-sm font-bold text-slate-500 uppercase">Email</label>
             <input type="email" defaultValue={user?.email} className="w-full p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-transparent focus:border-blue-400 outline-none dark:text-white" />
          </div>
          <Button className="mt-8">Save Changes</Button>
       </div>
    </div>
  );
};

export default ProfilePage;
