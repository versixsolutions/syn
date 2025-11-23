import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ==============================================================================
// CONFIGURAÇÃO VAPID (WEB PUSH)
// Cole aqui a sua PUBLIC KEY gerada pelo comando: npx web-push generate-vapid-keys
// ==============================================================================
const VAPID_PUBLIC_KEY = 'BFnGmgzVuz_U7xU8N_4PHG0tzsWdJ9JfX4F6YfyDs6htNypEMM2dTkJUFVRq6nPBdjztf1Q8PEmC6XBrSDkngPA' 

// Função utilitária para converter a chave base64 string para ArrayBuffer (necessário para o navegador)
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const { user } = useAuth()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // Verifica suporte inicial
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setPermission(Notification.permission)
      checkSubscription()
    }
  }, [user])

  async function checkSubscription() {
    if (!user || !('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      // Se existe uma subscrição no navegador, consideramos subscrito
      // (Idealmente, verificaríamos no banco se ela ainda é válida para este user)
      if (subscription) {
        setIsSubscribed(true)
      }
    } catch (error) {
      console.error('Erro ao verificar subscrição:', error)
    }
  }

  async function subscribe() {
    if (!user) return
    setLoading(true)

    try {
      // 1. Solicitar permissão ao usuário (Popup do navegador)
      const result = await Notification.requestPermission()
      setPermission(result)
      
      if (result !== 'granted') {
        throw new Error('Permissão de notificação foi negada pelo usuário.')
      }

      // 2. Obter o Service Worker ativo
      const registration = await navigator.serviceWorker.ready

      // 3. Criar a assinatura Push usando a chave VAPID pública
      // Isso gera um endpoint único para este dispositivo/navegador
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Obrigatório para Web Push padrão
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      console.log('Assinatura gerada:', subscription)

      // 4. Salvar a assinatura no Banco de Dados (Supabase)
      // A Edge Function usará estes dados para enviar o Push
      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        subscription: subscription.toJSON(), // Serializa para JSON
        user_agent: navigator.userAgent
      })

      // Se der erro de chave duplicada (usuário já registrou este dispositivo), ignoramos
      if (error && error.code !== '23505') throw error

      setIsSubscribed(true)
      alert('Notificações ativadas com sucesso! Você receberá alertas de novos comunicados.')

    } catch (error: any) {
      console.error('Erro ao ativar notificações:', error)
      
      let msg = 'Não foi possível ativar as notificações.'
      if (error.message.includes('denied')) msg = 'Você bloqueou as notificações. Ative-as nas configurações do navegador.'
      
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  // Função para cancelar (Opcional, mas boa prática)
  async function unsubscribe() {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        // Remove do navegador
        await subscription.unsubscribe()
        
        // Remove do banco (opcional, o backend limpa tokens inválidos automaticamente com o tempo)
        // await supabase.from('push_subscriptions').delete().match({ subscription: subscription.endpoint })
        
        setIsSubscribed(false)
        alert('Notificações desativadas.')
      }
    } catch (error) {
      console.error('Erro ao desativar:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    isSupported: 'Notification' in window && 'serviceWorker' in navigator,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe
  }
}