
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';

const ProfilePage = () => {
<<<<<<< HEAD
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
=======
  const { user, navigate, logout } = useContext(AppContext);
  
  const handleLogout = () => {
      if(window.confirm("Are you sure you want to log out?")) {
          logout();
          navigate('home');
      }
  };

  return (
    <div className="h-full flex flex-col p-5 pt-24 animate-slide-up">
       <div className="absolute top-6 left-5 z-20">
         <button onClick={() => navigate('home')} className="p-2 rounded-full bg-white/10 backdrop-blur-md"><Icons.Back /></button>
       </div>

       <div className="profile-header">
          <div className="avatar-ring mb-4">
             <img src={user?.avatar} className="avatar-lg" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-1">{user?.name}</h2>
          <p className="text-secondary">{user?.email}</p>
          <div className="mt-4 px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-bold border border-blue-500/20">
              {user?.isPro ? 'PRO ACCOUNT' : 'FREE PLAN'}
          </div>
       </div>

       <div className="space-y-6 flex-1 px-2">
          <div className="space-y-2">
             <label className="text-xs font-bold text-tertiary uppercase pl-1">Display Name</label>
             <input type="text" defaultValue={user?.name} className="glass-input" />
          </div>
          <div className="space-y-2">
             <label className="text-xs font-bold text-tertiary uppercase pl-1">Email</label>
             <input type="email" defaultValue={user?.email} className="glass-input" />
          </div>
          
          <button className="app-btn app-btn-primary mt-6">
              Save Changes
          </button>
       </div>

       <div className="mt-auto pb-8 px-2">
           <button onClick={handleLogout} className="app-btn app-btn-danger">
               Log Out
           </button>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
       </div>
    </div>
  );
};

export default ProfilePage;
