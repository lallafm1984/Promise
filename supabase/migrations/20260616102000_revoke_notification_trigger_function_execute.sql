revoke all on function public.notify_friend_request_created() from public;
revoke all on function public.notify_friend_request_created() from anon;
revoke all on function public.notify_friend_request_created() from authenticated;

revoke all on function public.notify_friend_request_accepted() from public;
revoke all on function public.notify_friend_request_accepted() from anon;
revoke all on function public.notify_friend_request_accepted() from authenticated;

revoke all on function public.notify_card_recipient_created() from public;
revoke all on function public.notify_card_recipient_created() from anon;
revoke all on function public.notify_card_recipient_created() from authenticated;
