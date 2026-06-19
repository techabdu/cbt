<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCbtAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file_number' => ['required', 'string', 'max:50', Rule::unique('users', 'file_number')],
            'name'        => ['required', 'string', 'max:255'],
            'email'       => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
        ];
    }
}
