<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCbtAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('cbt_admin')->id;

        return [
            'name'      => ['required', 'string', 'max:255'],
            'email'     => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
