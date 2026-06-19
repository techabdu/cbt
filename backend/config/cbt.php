<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Offline Server Mode
    |--------------------------------------------------------------------------
    |
    | When true, this instance is the CBT-center offline server that students
    | take exams on. The EnsureOfflineMode middleware uses this flag to gate the
    | student exam routes so they are unreachable on the public online server.
    |
    */

    'is_offline_server' => (bool) env('IS_OFFLINE_SERVER', false),

    /*
    |--------------------------------------------------------------------------
    | Offline Server URL
    |--------------------------------------------------------------------------
    |
    | LAN address of the offline server. The online server uses this to push
    | exam data to, and pull results from, the offline server. Left blank on the
    | offline server itself (it never calls outward).
    |
    */

    'offline_server_url' => env('OFFLINE_SERVER_URL'),

    /*
    |--------------------------------------------------------------------------
    | Sync Secret Key
    |--------------------------------------------------------------------------
    |
    | Shared secret authenticating server-to-server sync requests via the
    | X-Sync-Secret header. Must be identical on both online and offline servers
    | and must never be committed to version control.
    |
    */

    'sync_secret_key' => env('SYNC_SECRET_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Sync HTTP Settings
    |--------------------------------------------------------------------------
    */

    'sync_timeout' => (int) env('SYNC_TIMEOUT', 30),
    'sync_retries' => (int) env('SYNC_RETRIES', 3),

    /*
    |--------------------------------------------------------------------------
    | Exam Code Generation
    |--------------------------------------------------------------------------
    */

    'exam_code_length' => 8,

    /*
    |--------------------------------------------------------------------------
    | Grade Thresholds
    |--------------------------------------------------------------------------
    |
    | Percentage floor for each letter grade, evaluated high to low.
    |
    */

    'grade_thresholds' => [
        'A' => 70,
        'B' => 60,
        'C' => 50,
        'D' => 45,
        'F' => 0,
    ],

];
