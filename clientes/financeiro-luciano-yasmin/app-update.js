export async function updateApplication({currentVersion,refreshData,updateWorker,fetchVersion,hasUnsaved,flushChat,saveResume,reload,notify,isCurrent=()=>true}){
 await refreshData();if(!isCurrent())return 'cancelled';
 await updateWorker();const latest=await fetchVersion();if(!isCurrent())return 'cancelled';
 if(!latest||typeof latest.version!=='string')throw Error('Não foi possível conferir a versão. Tente atualizar novamente.');
 if(latest.version===currentVersion){notify('Aplicativo e dados atualizados.');return 'current';}
 if(hasUnsaved()){notify('Há uma atualização disponível. Conclua ou cancele o lançamento em andamento e toque em atualizar novamente.');return 'deferred';}
 await flushChat();if(!isCurrent())return 'cancelled';
 if(hasUnsaved()){notify('Conclua o lançamento em andamento antes de atualizar o aplicativo.');return 'deferred';}
 await saveResume();if(!isCurrent())return 'cancelled';notify('Atualizando o aplicativo…');reload();return 'reloading';
}
